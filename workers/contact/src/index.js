import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";

const recipient = "author.annie.elliot@gmail.com";
const sender = "info@annieelliot.co.uk";
const allowedOrigin = "http://localhost:8080";

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

    // Only allow POST requests
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: getCorsHeaders(),
      });
    }

    // Process the email
    try {
      const formData = await request.formData();
      const data = Object.fromEntries(formData);
      await sendEmail(data, env);
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

async function sendEmail(data, env) {
  const msg = createMimeMessage();
  msg.setSender({
    name: data.name,
    addr: sender,
  });
  msg.setRecipient(recipient);
  msg.setSubject(`A message from ${data.email}`);
  msg.addMessage({
    contentType: "text/plain",
    data: data.message,
  });

  var message = new EmailMessage(sender, recipient, msg.asRaw());
  await env.EMAIL.send(message);
}
