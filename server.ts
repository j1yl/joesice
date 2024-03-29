import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";
import { assert } from "https://deno.land/std@0.215.0/assert/mod.ts";
import * as cheerio from "npm:cheerio";
import { parse } from "npm:date-fns";
import nodemailer from "npm:nodemailer";

const SMTP_USER = Deno.env.get("SMTP_USER");
const SMTP_PASS = Deno.env.get("SMTP_PASS");
const SMTP_PORT = Deno.env.get("SMTP_PORT");
const SMTP_HOST = Deno.env.get("SMTP_HOST");
const RECEIVER_EMAILS = Deno.env.get("RECEIVER_EMAILS");

assert(
  SMTP_USER && SMTP_PASS && SMTP_PORT && SMTP_HOST && RECEIVER_EMAILS,
  "Missing environment variables"
);

const receiverEmails = RECEIVER_EMAILS.split(",");
receiverEmails.forEach((s) => s.trim());

type Result = {
  flavors: string[];
  date: Date | null;
};

const result: Result = {
  flavors: [],
  date: null,
};

function parseDateString(dateStr: string) {
  const format = "EEEE , MMMM do yyyy";
  const parsedDate = parse(dateStr, format, new Date());
  return parsedDate || null;
}

function sendEmail(result: Result) {
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || "465"),
    secure: true,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  if (!RECEIVER_EMAILS) {
    console.log("No destination emails found");
    return;
  }

  for (const receiver of receiverEmails) {
    const msg = {
      from: `Joe Lee <${SMTP_USER}>`,
      to: receiver,
      subject: `${
        receiver === "chloekadiman@gmail.com" ?? "Hi PAUF! "
      }Joe's Ice has your favorite flavors!${
        receiver === "chloekadiman@gmail.com" ?? " 🍦🍦🍦 >_< 0_o ._. :3 <8"
      }`,
      text: `Flavors:\n\n${result.flavors.join("\n")}\n\n${result.date}`,
    };

    transporter.sendMail(msg, (err: Error) => {
      if (err) {
        console.error(`${err}`);
      } else {
        console.log("Email sent!");
      }
    });
  }
}

async function scrape() {
  const url = "https://joesice.com/";
  const res: string[] = [];

  try {
    const response = await fetch(url);
    const html = await response.text();
    const document = new DOMParser().parseFromString(html, "text/html");
    assert(document);

    const $ = cheerio.load(html);
    assert($);

    $(".et_pb_text_inner").each((_, element) => {
      if ($(element).text().toLowerCase().includes("anaheim")) {
        $(element)
          .find("span")
          .each((_, span) => {
            res.push($(span).text().trim());
          });
      }
    });

    return res;
  } catch (error) {
    console.error(`Error: ${error}`);
  }
}

async function job() {
  const scrapeResult = await scrape();
  assert(scrapeResult);
  scrapeResult.pop();
  result.date = parseDateString(scrapeResult[scrapeResult.length - 1]);

  for (let i = 3; i < scrapeResult.length - 1; i++) {
    result.flavors.push(scrapeResult[i]);
  }

  const found = result.flavors.some(
    (f) =>
      f.toLowerCase().includes("peach") ||
      f.toLowerCase().includes("kiwi") ||
      f.toLowerCase().includes("smurf")
  );

  if (found) {
    sendEmail(result);
  }

  console.log(result);
}

Deno.cron("Check flavors", "0 20 * * *", () => {
  job();
});

Deno.serve(async (req) => {
  const res: Result = {
    flavors: [],
    date: null,
  };

  if (req.method !== "GET" || req.url !== "/") {
    return new Response("", {
      status: 405,
    });
  }

  const scrapeResult = await scrape();
  if (!scrapeResult) {
    return new Response("", {
      status: 500,
    });
  }

  for (let i = 3; i < scrapeResult.length - 1; i++) {
    res.flavors.push(scrapeResult[i]);
  }

  const found = res.flavors.some(
    (f) =>
      f.toLowerCase().includes("peach") ||
      f.toLowerCase().includes("kiwi") ||
      f.toLowerCase().includes("smurf")
  );

  res.date = parseDateString(scrapeResult[scrapeResult.length - 1]);

  const body = JSON.stringify({
    ...res,
    found,
  });

  return new Response(body, {
    status: 200,
  });
});
