import axios, { AxiosError, AxiosInstance } from "axios";
import setCookie, { CookieMap } from "set-cookie-parser";
import cookie from "cookie";
import fs from "fs/promises";
import { createWriteStream, mkdirSync, existsSync, ReadStream } from "fs";
import { v4 } from "uuid";

export interface SearchParams {
  count: string;
  filters: string;
  origin: string;
  q: string;
  start: number;
  queryContext: string;
}

class Request {
  request!: AxiosInstance;
  LINKEDIN_BASE_URL = "https://www.linkedin.com";
  CSRF_TOKEN?: string;
  COOKIES?: string;
  MAX_SEARCH_COUNT = 49;
  DOWNLOADS_DIR = "./downloads";

  constructor() {
    this.initAxios();
    if (!existsSync(this.DOWNLOADS_DIR)) mkdirSync(this.DOWNLOADS_DIR);
  }

  async search(
    params: Partial<SearchParams>,
    limit: number = -1,
    offset: number = 0
  ) {
    let count = this.MAX_SEARCH_COUNT;
    const results: any[] = [];
    while (true) {
      if (limit > -1 && limit - results.length < count) {
        count = limit - results.length;
      }

      const requestParams = Object.assign(
        {
          decorationId:
            "com.linkedin.voyager.dash.deco.search.SearchClusterCollection-158",
          origin: "SWITCH_SEARCH_VERTICAL",
          q: "all",
          query:
            "(keywords:#video,flagshipSearchIntent:SEARCH_SRP,queryParameters:(resultType:List(CONTENT)),includeFiltersInResponse:true)",
          start: String(results.length + offset),
          count: String(count),
        },
        params
      );

      try {
        const res = await this.request.get(`/search/dash/clusters`, {
          baseURL: this.LINKEDIN_BASE_URL + "/voyager/api",
          params: requestParams,
          headers: {
            Accept: "application/vnd.linkedin.normalized+json+2.1",
            "x-restli-protocol-version": "2.0.0",
            cookie: this.COOKIES!,
            "csrf-token": this.CSRF_TOKEN!,
          },
        });

        const posts = (res.data.included as object[]).filter(
          (entity) => "entityEmbeddedObject" in entity
        );

        results.push(...posts);

        // @ts-ignore
        console.log("downloading videos...");
        await this.downloadVideoIfExist(
          posts.map((e: any) => e.targetUnion.updateV2Urn)
        );

        if (
          limit === -1 &&
          "total" in res.data.data?.paging &&
          limit > res.data.data.paging.total
        ) {
          limit = res.data.data.paging.total;
        }

        console.log("search paging: ", res.data.data.paging);
      } catch (e) {
        console.log("error while searching: ", e);
      }

      if (results.length >= limit) {
        console.log(`fetched ${results.length} posts`);

        await fs.writeFile("result.json", JSON.stringify(results), {
          encoding: "utf-8",
        });

        break;
      }
    }
  }

  /**
   * @param urn an array of updateV2 urn string
   */
  private async downloadVideoIfExist(urn: string[]) {
    try {
      const ids = `List(${urn.map(this.encodeURI).join(",")})`;
      const res = await this.request.get(`/feed/updatesV2?ids=${ids}`, {
        baseURL: this.LINKEDIN_BASE_URL + "/voyager/api",
        params: {
          commentsCount: 10,
          likesCount: 10,
        },
        headers: {
          Accept: "application/vnd.linkedin.normalized+json+2.1",
          "x-restli-protocol-version": "2.0.0",
          cookie: this.COOKIES!,
          "csrf-token": this.CSRF_TOKEN!,
        },
      });

      const videoEntities = res.data.included.filter(
        (e: object) => "thumbnail" in e
      ) as any[];

      await Promise.all(
        videoEntities.map(async (ent) => {
          const durationInSec = Math.floor(ent.duration / 1000);
          const fileName = v4() + ".mp4";
          const file = createWriteStream(`${this.DOWNLOADS_DIR}/${fileName}`);
          const videoUrl = ent.progressiveStreams[0].streamingLocations[0].url;
          const res = await this.request.get(videoUrl, {
            responseType: "stream",
          });

          (res.data as ReadStream).pipe(file);

          file.on("error", (err) => {
            console.log("Failed to download video: ", err);
            return fs.unlink(fileName);
          });

          file.on("finish", () => {
            file.close();
            console.log(`file: ${fileName}, duration: ${durationInSec}s`);
          });
        })
      );
    } catch (e) {
      console.log("error downloading video: ", e);
    }
  }

  async authenticate(username: string, password: string) {
    const payload = new URLSearchParams({
      session_key: username,
      session_password: password,
      JSESSIONID: this.CSRF_TOKEN!,
    });

    try {
      const res = await this.request.post("uas/authenticate", payload, {
        headers: {
          "X-Li-User-Agent":
            "LIAuthLibrary:3.2.4 com.linkedin.LinkedIn:8.8.1 iPhone:8.3",
          "User-Agent": "LinkedIn/8.8.1 CFNetwork/711.3.18 Darwin/14.0.0",
          "X-User-Language": "en",
          "X-User-Locale": "en_US",
          "Accept-Language": "en-us",
          "csrf-token": this.CSRF_TOKEN!,
          Cookie: this.COOKIES!,
        },
      });

      this.setCookiesFromRequestHeader(res.headers["set-cookie"]);
    } catch (e) {
      if (e instanceof AxiosError) {
        if (e.response?.data.login_result === "CHALLENGE") {
          console.log("linkedin challenge error...");
        }
      }
    }
  }

  async doAuthChallenge() {}

  async getSessionCookies() {
    const res = await this.request.get("uas/authenticate");
    this.setCookiesFromRequestHeader(res.headers["set-cookie"]);
  }

  private setCookiesFromRequestHeader(value: string[] | undefined) {
    const cookies = setCookie.parse(value!, {
      map: true,
    });

    this.setCookies(cookies);

    if ("JSESSIONID" in cookies) {
      // JSESSIONID value is "ajax:123103930931"
      // we need to strip the double quotes
      this.CSRF_TOKEN = cookies.JSESSIONID.value.replace(/\"/g, "");
    }
  }

  private setCookies(cookies: CookieMap) {
    const _cookies = [];
    for (const [name, v] of Object.entries(cookies)) {
      _cookies.push(
        cookie.serialize(name, v.value, {
          encode: (v) => v,
        })
      );
    }
    this.COOKIES = _cookies.join("; ");
  }

  private initAxios() {
    this.request = axios.create({
      baseURL: this.LINKEDIN_BASE_URL,
    });
  }

  private encodeURI(str: string) {
    return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
      return "%" + c.charCodeAt(0).toString(16);
    });
  }
}

export default Request;
