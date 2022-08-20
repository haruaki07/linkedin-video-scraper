import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import setCookie, { CookieMap } from "set-cookie-parser";
import cookie from "cookie";
import fs from "fs/promises";
import {
  createWriteStream,
  mkdirSync,
  existsSync,
  unlinkSync,
  ReadStream,
} from "fs";
import { v4 } from "uuid";
import { PostEntity } from "../types/post-entity";
import { PostUpdatesV2MediaEntity } from "../types/post-updatesv2-entity";

export interface SearchParams {
  decorationId: string;
  origin: string;
  q: string;
  query: string;
  start: string;
  count: string;
}

interface SearchVideoOptions {
  params?: Partial<SearchParams>;
  keywords?: string;
  limit?: number;
  offset?: number;
}

class Request {
  request!: AxiosInstance;
  LINKEDIN_BASE_URL = "https://www.linkedin.com";
  LINKEDIN_API_BASE_URL = `${this.LINKEDIN_BASE_URL}/voyager/api`;
  CSRF_TOKEN?: string;
  COOKIES?: string;
  MAX_SEARCH_COUNT = 49;
  DATA_DIR = "./data";
  COOKIE_FILE_PATH = `${this.DATA_DIR}/cookie`;
  DOWNLOADS_DIR = "./downloads";

  constructor() {
    this.initAxios();
    if (!existsSync(this.DOWNLOADS_DIR)) mkdirSync(this.DOWNLOADS_DIR);
  }

  async searchVideos({
    params,
    keywords = "#video",
    limit = -1,
    offset = 0,
  }: SearchVideoOptions) {
    let count = +(params?.count ?? this.MAX_SEARCH_COUNT);
    const results: PostEntity[] = [];
    let fetched = 0;
    let downloaded = 0;

    // fetch till reach the limit
    while (true) {
      // when we're close to the limit, only fetch what we need to
      if (limit > -1 && limit - fetched < count) {
        count = limit - fetched;
      }

      const requestParams = Object.assign(
        {
          decorationId:
            "com.linkedin.voyager.dash.deco.search.SearchClusterCollection-158",
          origin: "SWITCH_SEARCH_VERTICAL",
          q: "all",
          query: `(keywords:${keywords},flagshipSearchIntent:SEARCH_SRP,queryParameters:(resultType:List(CONTENT)),includeFiltersInResponse:true)`,
          start: String(results.length + offset),
          count: String(count),
        },
        params
      );

      try {
        const res = (await this.request.get(`/search/dash/clusters`, {
          baseURL: this.LINKEDIN_API_BASE_URL,
          params: requestParams,
          headers: {
            Accept: "application/vnd.linkedin.normalized+json+2.1",
            "x-restli-protocol-version": "2.0.0",
            cookie: this.COOKIES!,
            "csrf-token": this.CSRF_TOKEN!,
          },
        })) as AxiosResponse<{ data: any; included: PostEntity[] }>;

        const posts = res.data.included.filter(
          (ent) => "entityEmbeddedObject" in ent
        );

        results.push(...posts);
        fetched += count;

        console.log("downloading videos if available...");
        const result = await this.downloadVideoIfExist(
          posts.map((ent) => ent.targetUnion.updateV2Urn)
        );
        downloaded +=
          result?.filter((r) => r.status === "fulfilled").length ?? 0;

        // set limit from the response if,
        // limit not set or exceeded
        if (
          "total" in res.data.data?.paging &&
          (limit === -1 || limit > res.data.data.paging.total)
        ) {
          limit = res.data.data.paging.total;
        }
      } catch (e) {
        console.log("error while searching: ", e);
      }

      if (fetched >= limit) break;
    }

    return {
      fetched,
      downloaded,
    };
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
      ) as PostUpdatesV2MediaEntity[];

      return Promise.allSettled(
        videoEntities.map((ent) => {
          return new Promise<string>(async (resolv, reject) => {
            const durationInSec = Math.floor(ent.duration / 1000);

            if (durationInSec < 2 || durationInSec > 30) {
              console.log(`duration: ${durationInSec}s, skipped...`);
              return reject(new Error("invalid duration"));
            }

            const fileName = v4() + ".mp4";
            const file = createWriteStream(`${this.DOWNLOADS_DIR}/${fileName}`);
            const videoUrl =
              ent.progressiveStreams[0].streamingLocations[0].url;
            const res = await this.request.get(videoUrl, {
              responseType: "stream",
            });

            (res.data as ReadStream).pipe(file);

            file.on("error", (err) => {
              console.log("Failed to download video: ", err);
              unlinkSync(fileName);
              reject(err);
            });

            file.on("finish", () => {
              file.close();
              console.log(`file: ${fileName}, duration: ${durationInSec}s`);
              resolv(fileName);
            });
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
