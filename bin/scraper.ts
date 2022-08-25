import { program } from "commander";
import LinkedIn, { LinkedInChallengeError } from "../lib/linkedin";
import { int } from "../lib/utils";
import { prompt } from "enquirer";

(async () => {
  try {
    program
      .option("-k, --keywords [keywords]", "Keywords to search", "#video")
      .option("-U, --username <username>", "LinkedIn account username or email")
      .option("-P, --password <password>", "LinkedIn account password")
      .option("--limit [number]", "Public post search limit", int, 50)
      .option("--min [number]", "Video minimum duration in seconds", int, 2)
      .option("--max [number]", "Video maximum duration in seconds", int, 30)
      .option("--data-dir [path]", "Data directory path", "./data");
    await program.parseAsync();

    const opts = program.opts<{
      keywords: string;
      username: string;
      password: string;
      limit: number;
      min: number;
      max: number;
      dataDir: string;
    }>();

    if (!opts.username && !opts.password) return program.help();

    const client = new LinkedIn(opts.username, opts.password, opts.dataDir);
    console.log(`> initializing...`);
    try {
      await client.init();
    } catch (e) {
      if (!(e instanceof LinkedInChallengeError)) throw e;
      await client.doAuthChallenge(() => {
        return prompt<{ pin: string }>({
          type: "input",
          name: "pin",
          message:
            "LinkedIn will send you emails, check them and enter the PIN",
        }).then((r) => r.pin);
      });
      process.exit();
    }

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
