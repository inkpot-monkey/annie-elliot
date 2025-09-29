export default {
  async scheduled(controller, env, ctx) {
    try {
      const response = await fetch(
        "https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/80617396-5fc7-4d60-84e3-b46bac674064",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      const data = await response.json();
      console.log("Deploy triggered:", data);
      return data;
    } catch (error) {
      console.error("Error triggering deploy:", error);
      throw error;
    }
  },
};
