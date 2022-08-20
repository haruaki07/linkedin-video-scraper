import { program } from "commander";
import Request from "../lib/request";
import { int } from "../lib/utils";

(async () => {
  try {
    program
      .option(
        "-k, --keywords [keywords]",
        "Keywords to search (default: #video)"
      )
      .option("-U, --username <username>", "LinkedIn account username or email")
      .option("-P, --password <password>", "LinkedIn account password")
      .option("--min [number]", "Video minimum duration in seconds", int, 2)
      .option("--max [number]", "Video maximum duration in seconds", int, 30);
    await program.parseAsync();

    const opts = program.opts<{
      keywords: string;
      username: string;
      password: string;
      min: number;
      max: number;
    }>();

    if (!opts.username && !opts.password) return program.help();

    const client = new Request();

    await client.getSessionCookies();
    console.log("> authenticating...");
    await client.authenticate(opts.username, opts.password);

    console.log("> searching videos...");
    const { fetched, downloaded } = await client.searchVideos({
      params: {
        count: "5",
      },
      limit: 20,
    });

    console.log(`> fetched ${fetched} posts`);
    console.log(`> downloaded ${downloaded} videos`);
  } catch (e) {
    console.log(e);
  }
})();
