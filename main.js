const n8n = require("./src/n8n.js").n8n;

const INSTANCE = {
  URL: process.env.URL,
  API_KEY: process.env.API_KEY,
};

async function main() {
  let projects = await n8n.get.projects(INSTANCE, 10);
  console.log(projects);

  let users = await n8n.get.users(INSTANCE, 10);
  console.log(users);

  let workflows = await n8n.get.workflows(INSTANCE, 10);
  console.log(workflows);
}

main();
