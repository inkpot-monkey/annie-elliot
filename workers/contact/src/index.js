import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";

const recipient = "thomassdk@pm.me";
const sender = "info@annieelliot.co.uk";
const allowedOrigin = "https://annie-elliot.co.uk";

export default {
  async fetch(request, env) {
    // Handle preflight requests
    if (request.method === "OPTIONS") {
      return handleCors(request);
    }

    // Verify request origin
    if (!isValidOrigin(request)) {
      return new Response("Unauthorized", { status: 403 });
    }

    // Only allow GET requests
    if (request.method !== "GET") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: getCorsHeaders(),
      });
    }

    // Process the email
    try {
      await sendEmail(env);
      return new Response("Email sent successfully!", {
        headers: getCorsHeaders(),
      });
    } catch (e) {
      return new Response(e.message, {
        status: 500,
        headers: getCorsHeaders(),
      });
    }
  },
};

function isValidOrigin(request) {
  const origin =
    request.headers.get("Origin") || request.headers.get("Referer");
  return origin && origin.startsWith(allowedOrigin);
}

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function handleCors() {
  return new Response(null, {
    headers: getCorsHeaders(),
  });
}

async function sendEmail(env) {
  const msg = createMimeMessage();
  msg.setSender({
    name: "Website: Annie Elliot",
    addr: sender,
  });
  msg.setRecipient(recipient);
  msg.setSubject("A message from the website Annie Elliot");
  msg.addMessage({
    contentType: "text/plain",
    data: `Congratulations, you just got a message from a reader!`,
  });

  var message = new EmailMessage(sender, recipient, msg.asRaw());
  await env.EMAIL.send(message);
}
