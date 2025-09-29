import { Octokit } from "@octokit/core";

const expectedChannelId = "23d0e5a0-f757-436b-be5d-25902d44c208v2";
const expectedResourceId = "j2RYsyE5LveTfUKYVkgJ3f18N3A";

export default {
  async fetch(request, env, ctx) {
    // Only process POST requests (Google Calendar sends POST)
    if (request.method === "POST") {
      // Extract the headers from the request
      const headers = Object.fromEntries([...request.headers]);

      // Verify the channel ID and other headers if needed
      const channelId = headers["x-goog-channel-id"];
      const resourceState = headers["x-goog-resource-state"];
      const resourceId = headers["x-goog-resource-id"];

      // Log or process the notification
      console.log(
        `Received notification: ${resourceState} for channel ${channelId} with resource id ${resourceId}`,
      );

      if (
        channelId !== expectedChannelId ||
        resourceId !== expectedResourceId
      ) {
        return new Response("", { status: 400 });
      }

      await triggerGitHubWorkflow(env.GITHUB_WORKFLOW_KEY);

      // Return success status code
      return new Response("", { status: 200 });
    }

    // Handle non-POST requests
    return new Response("Calendar webhook endpoint", { status: 200 });
  },
};

async function triggerGitHubWorkflow(auth) {
  const owner = "inkpot-monkey";
  const repo = "author-annie-elliot";
  const workflow_id = "main";

  // https://github.com/octokit/core.js#readme
  const octokit = new Octokit({
    auth,
  });

  const response = await octokit.request(
    `POST /repos/${owner}/${repo}/actions/workflows/${workflow_id}/dispatches`,
    {
      owner,
      repo,
      workflow_id,
      ref: "main",
      inputs: {
        source: "calendar_webhook",
        timestamp: new Date().toISOString(),
      },
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  console.log(response);
}
