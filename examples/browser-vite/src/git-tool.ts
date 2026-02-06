import * as git from "isomorphic-git";
// @ts-ignore
import http from "isomorphic-git/http/web";
// @ts-ignore
import { defineCommand } from "just-bash";

export const gitTool = defineCommand("git", async (args: string[], ctx: any) => {
  const command = args[0];
  const gitArgs = args.slice(1);

  const wrapStat = (stat: any) => {
    const mtime = stat.mtime || new Date();
    return {
      ...stat,
      mode: stat.mode || (stat.isDirectory ? 0o755 : 0o644),
      uid: 1, gid: 1, dev: 1, ino: 1, nlink: 1,
      atime: mtime, mtime: mtime, ctime: mtime, birthtime: mtime,
      atimeMs: mtime.getTime(), mtimeMs: mtime.getTime(), ctimeMs: mtime.getTime(), birthtimeMs: mtime.getTime(),
      isDirectory: () => !!stat.isDirectory,
      isFile: () => !stat.isDirectory,
      isSymbolicLink: () => false,
      size: stat.size || 0,
    };
  };

  const toLatin1 = (uint8: Uint8Array) => {
    let result = "";
    for (let i = 0; i < uint8.length; i++) result += String.fromCharCode(uint8[i]);
    return result;
  };
  const fromLatin1 = (str: string) => {
    if (typeof str !== 'string') return str;
    const uint8 = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) uint8[i] = str.charCodeAt(i);
    return uint8;
  };

  const fs: any = { promises: {} };
  ['readFile', 'writeFile', 'unlink', 'readdir', 'mkdir', 'rmdir', 'stat', 'lstat', 'readlink', 'symlink'].forEach(m => {
    const feat = (ctx.fs as any)[m] || (m === 'rmdir' ? (ctx.fs as any).rm : null);

    const wrapped = async (...args: any[]) => {
      if (!feat) {
        if (m === 'readlink' || m === 'symlink') throw new Error(`ENOENT`);
        throw new Error(`Method ${m} not implemented`);
      }
      let callArgs = [...args];
      if (m === 'writeFile' && typeof args[1] !== 'string') {
        callArgs[1] = toLatin1(args[1]);
      }
      if (['readFile', 'readdir', 'stat', 'lstat', 'unlink', 'rmdir', 'mkdir'].includes(m)) {
        callArgs = [args[0]];
      }

      try {
        let res = await feat.apply(ctx.fs, callArgs);
        if (m === 'readFile') res = fromLatin1(res);
        if (m === 'stat' || m === 'lstat') res = wrapStat(res);
        return res;
      } catch (e: any) {
        if (e.message.includes("ENOENT") || e.name === "NotFoundError") {
          const err: any = new Error(`ENOENT`);
          err.code = 'ENOENT';
          throw err;
        }
        throw e;
      }
    };

    fs[m] = (...args: any[]) => {
      const cb = args[args.length - 1];
      if (typeof cb !== 'function') return wrapped(...args);
      wrapped(...args.slice(0, -1)).then(res => cb(null, res)).catch(cb);
    };
    fs.promises[m] = wrapped;
  });

  const dir = ctx.cwd || "/";

  try {
    switch (command) {
      case "init":
        await git.init({ fs, dir });
        return { stdout: `Initialized empty Git repository in ${dir}\n`, stderr: "", exitCode: 0 };

      case "add":
        for (const filepath of gitArgs) {
          await git.add({ fs, dir, filepath });
        }
        return { stdout: "", stderr: "", exitCode: 0 };

      case "commit":
        const messageArg = gitArgs.find(a => a.startsWith("-m="));
        const message = messageArg ? messageArg.split("=")[1] : "auto commit";
        const sha = await git.commit({
          fs,
          dir,
          message,
          author: { name: "Agent", email: "agent@deepagents.ai" }
        });
        return { stdout: `[main ${sha.substring(0, 7)}] ${message}\n`, stderr: "", exitCode: 0 };

      case "status":
        const status = await git.statusMatrix({ fs, dir });
        const output = status.map(([path, head, workdir, stage]) => {
          return `${path}: ${head} ${workdir} ${stage}`;
        }).join("\n");
        return { stdout: output + "\n", stderr: "", exitCode: 0 };

      case "clone":
        const url = gitArgs[0];
        const cloneDir = gitArgs[1] || dir;
        await git.clone({
          fs,
          http,
          dir: cloneDir,
          url,
          singleBranch: true,
          depth: 1
        });
        return { stdout: `Cloned into '${cloneDir}'\n`, stderr: "", exitCode: 0 };

      case "log":
        const commits = await git.log({ fs, dir, depth: 5 });
        const logOutput = commits.map(c => {
          return `commit ${c.oid}\nAuthor: ${c.commit.author.name}\nDate: ${new Date(c.commit.author.timestamp * 1000).toString()}\n\n    ${c.commit.message}\n`;
        }).join("\n");
        return { stdout: logOutput + "\n", stderr: "", exitCode: 0 };

      default:
        return { stdout: "", stderr: `Unknown git command: ${command}\n`, exitCode: 1 };
    }
  } catch (e: any) {
    return { stdout: "", stderr: `Git error: ${e.message}\n`, exitCode: 1 };
  }
});
