import { spawn } from "node:child_process";

const commands = [
  ["node", ["server.mjs"]],
  ["npm", ["run", "dev"]]
];

const children = commands.map(([command, args]) =>
  spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32"
  })
);

function stopAll() {
  for (const child of children) {
    child.kill();
  }
}

process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopAll();
  process.exit(0);
});
