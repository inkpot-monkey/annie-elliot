import { EmailMessage } from "cloudflare:email";
import * as MimeText from "mimetext";
const { createMimeMessage } = MimeText;

const recipient = "author.annie.elliot@gmail.com";
const sender = "info@annieelliot.co.uk";
const allowedOrigin = "https://annieelliot.co.uk";

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
      return Response.redirect(`${allowedOrigin}/email-success`, 303);
    } catch (e) {
      console.error("Email error:", e);
      return Response.redirect(`${allowedOrigin}/email-failure`, 303);
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
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function handleCors() {
  return new Response(null, {
    headers: getCorsHeaders(),
  });
}

async function sendEmail(data, env) {
  // Validate email
  if (!data.email || typeof data.email !== "string" || !data.email.includes("@")) {
    console.error("Invalid email address:", data.email);
    // Don't set Reply-To if invalid, just send the message
  }

  const msg = createMimeMessage();
  msg.setSender({
    name: data.name,
    addr: sender,
  });
  msg.setRecipient(recipient);
  msg.setSubject(`A message from ${data.email}`);

  // Safely attempt to set Reply-To
  if (data.email && typeof data.email === "string" && data.email.includes("@")) {
    try {
      if (MimeText.Mailbox) {
        msg.setHeader("Reply-To", new MimeText.Mailbox(data.email));
      } else {
        msg.setHeader("Reply-To", { addr: data.email });
      }
    } catch (e) {
      console.warn("Failed to set Reply-To header:", e);
    }
  }

  msg.addMessage({
    contentType: "text/plain",
    data: data.message,
  });

  var message = new EmailMessage(sender, recipient, msg.asRaw());
  await env.EMAIL.send(message);
}
