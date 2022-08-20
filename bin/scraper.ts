import { AxiosError } from "axios";
import Request from "../lib/request";

const client = new Request();

(async () => {
  try {
    await client.getSessionCookies();
    console.log("authenticating...");
    await client.authenticate("", "");
    console.log("searching...");
    await client.search(
      {
        count: "5",
      },
      20
    );
  } catch (e) {
    console.log(e);
    if (e instanceof AxiosError) {
      console.log(e.message);
    }
  }
})();
