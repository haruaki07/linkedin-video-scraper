import { AxiosError } from "axios";
import Request from "../lib/request";

const client = new Request();

(async () => {
  try {
    await client.getSessionCookies();
    console.log("> authenticating...");
    await client.authenticate("", "");

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
