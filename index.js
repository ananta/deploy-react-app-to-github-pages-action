const core = require("@actions/core");
const exec = require("@actions/exec");
const github = require("@actions/github");
const io = require("@actions/io");
const ioUtil = require("@actions/io/lib/io-util");

async function run() {
  try {
    const accessToken = core.getInput("access-token");
    if (!accessToken) {
      core.setFailed(
        "No personal access token found. Please provide one by setting the `access-token` input for this action."
      );
      return;
    }

    let deployBranch = core.getInput("deploy-branch");
    if (!deployBranch) deployBranch = "master";

    if (github.context.ref === `refs/heads/${deployBranch}`) {
      console.log(`Triggered by branch used to deploy: ${github.context.ref}.`);
      console.log("Nothing to deploy.");
      return;
    }

    const pkgManager = (await ioUtil.exists("./yarn.lock")) ? "yarn" : "npm";
    console.log(`Installing your site's dependencies using ${pkgManager}.`);
    await exec.exec(`${pkgManager} install`);
    console.log("Finished installing dependencies.");

    console.log("Ready to build your React site!");
    console.log(`Building with: ${pkgManager} run build`);
    await exec.exec(`${pkgManager} run build`);
    console.log("Finished building your site.");

    const cnameExists = await ioUtil.exists("./CNAME");
    if (cnameExists) {
      console.log("Copying CNAME over.");
      await io.cp("./CNAME", "./public/CNAME", { force: true });
      console.log("Finished copying CNAME.");
    }

    const deployRepo = core.getInput("deploy-repo");
    const repo = `${github.context.repo.owner}/${deployRepo ||
      github.context.repo.repo}`;
    const repoURL = `https://${accessToken}@github.com/${repo}.git`;
    console.log("Ready to deploy your react web app.");
    console.log(`Deploying to repo: ${repo} and branch: ${deployBranch}`);
    await exec.exec(`git init`, [], { cwd: "./public" });
    await exec.exec(`git config user.name`, [github.context.actor], {
      cwd: "./public"
    });
    await exec.exec(
      `git config user.email`,
      [`${github.context.actor}@users.noreply.github.com`],
      { cwd: "./public" }
    );
    await exec.exec(`git add`, ["."], { cwd: "./public" });
    await exec.exec(
      `git commit`,
      ["-m", `deployed via React Deploy Action 🎩 for ${github.context.sha}`],
      { cwd: "./public" }
    );
    await exec.exec(`git push`, ["-f", repoURL, `master:${deployBranch}`], {
      cwd: "./public"
    });
    console.log("✨✨✨Finished deploying your site✨✨✨");
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
