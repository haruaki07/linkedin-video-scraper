import { program } from "commander";
import LinkedIn from "../lib/linkedin";
import { int } from "../lib/utils";

(async () => {
  try {
    program
      .option("-k, --keywords [keywords]", "Keywords to search", "#video")
      .option("-U, --username <username>", "LinkedIn account username or email")
      .option("-P, --password <password>", "LinkedIn account password")
      .option("--limit [number]", "Public post search limit", int, 50)
      .option("--min [number]", "Video minimum duration in seconds", int, 2)
      .option("--max [number]", "Video maximum duration in seconds", int, 30);
    await program.parseAsync();

    const opts = program.opts<{
      keywords: string;
      username: string;
      password: string;
      limit: number;
      min: number;
      max: number;
    }>();

    if (!opts.username && !opts.password) return program.help();

    const client = new LinkedIn(opts.username, opts.password);
    console.log(`> initializing...`);
    await client.init();

    console.log(
      `> searching ${opts.min}-${opts.max}s videos with keywords "${opts.keywords}"`
    );
    const { fetched, downloaded } = await client.searchVideos({
      params: {
        count: "5",
      },
      ...(opts.keywords ? { keywords: opts.keywords } : {}),
      limit: opts.limit,
      duration: { min: opts.min, max: opts.max },
    });

    console.log(`> fetched ${fetched} posts`);
    console.log(`> downloaded ${downloaded} videos`);
  } catch (e) {
    console.log(e);
  }
})();
