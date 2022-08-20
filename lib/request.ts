import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import setCookie, { CookieMap } from "set-cookie-parser";
import cookie from "cookie";
import fs from "fs/promises";
import { constants, createWriteStream, unlinkSync, ReadStream } from "fs";
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

interface CookieValue {
  username: string;
  cookies: string;
  csrfToken: string;
}

class Request {
  user!: { username: string; password: string };
  request!: AxiosInstance;
  LINKEDIN_BASE_URL = "https://www.linkedin.com";
  LINKEDIN_API_BASE_URL = `${this.LINKEDIN_BASE_URL}/voyager/api`;
  CSRF_TOKEN?: string;
  COOKIES?: string;
  MAX_SEARCH_COUNT = 49;
  DATA_DIR = "./data";
  COOKIE_FILE_PATH = `${this.DATA_DIR}/cookie.json`;
  DOWNLOADS_DIR = `${this.DATA_DIR}/downloads`;

  constructor(username: string, password: string) {
    this.user = { username, password };
    this.initAxios();
  }

  async init() {
    await this.ensureDataDir();
    try {
      await this.loadCookiesFromFile();
    } catch (e) {
      console.log("authenticating...");
      await this.getSessionCookies();
      await this.authenticate();
    }
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
        const res: AxiosResponse<{ data: any; included: PostEntity[] }> =
          await this.request.get(`/search/dash/clusters`, {
            baseURL: this.LINKEDIN_API_BASE_URL,
            params: requestParams,
            headers: {
              Accept: "application/vnd.linkedin.normalized+json+2.1",
              "x-restli-protocol-version": "2.0.0",
              cookie: this.COOKIES!,
              "csrf-token": this.CSRF_TOKEN!,
            },
          });

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
              console.log(
                `downloaded! file: ${fileName}, duration: ${durationInSec}s`
              );
              resolv(fileName);
            });
          });
        })
      );
    } catch (e) {
      console.log("error downloading video: ", e);
    }
  }

  async authenticate() {
    const { username, password } = this.user!;
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

  async ensureDataDir() {
    await this.ensureDir(this.DATA_DIR);
    await this.ensureDir(this.DOWNLOADS_DIR);
  }

  async getSessionCookies() {
    const res = await this.request.get("uas/authenticate");
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

  private async loadCookiesFromFile() {
    const cookieValues = JSON.parse(
      await fs.readFile(this.COOKIE_FILE_PATH, { encoding: "utf-8" })
    ) as CookieValue[];
    const cookie = cookieValues.find((c) => c.username === this.user?.username);
    if (!cookie) throw new Error("cookie not available");
    this.CSRF_TOKEN = cookie.csrfToken;
    this.COOKIES = cookie.cookies;
  }

  /**
   * Initialize axios instance
   */
  private initAxios() {
    this.request = axios.create({
      baseURL: this.LINKEDIN_BASE_URL,
    });

    // save cookie after request call
    this.request.interceptors.response.use(async (res) => {
      if (res.headers["set-cookie"]) {
        const cookies = setCookie(res.headers["set-cookie"], { map: true });
        if ((cookies.JSESSIONID || cookies.li_at) && this.user) {
          this.setCookies(cookies);
          this.CSRF_TOKEN = cookies.JSESSIONID.value.replace(/\"/g, "");

          let cookieValues: CookieValue[] = [];

          try {
            cookieValues = JSON.parse(
              await fs.readFile(this.COOKIE_FILE_PATH, { encoding: "utf-8" })
            );
            cookieValues = cookieValues.map((c) => {
              if (c.username === this.user?.username) {
                c = {
                  username: this.user?.username!,
                  cookies: this.COOKIES!,
                  csrfToken: this.CSRF_TOKEN!,
                };
              }
              return c;
            });
          } catch {
            cookieValues.push({
              username: this.user?.username,
              cookies: this.COOKIES!,
              csrfToken: this.CSRF_TOKEN!,
            });
          }

          await fs.writeFile(
            this.COOKIE_FILE_PATH,
            JSON.stringify(cookieValues),
            { encoding: "utf-8" }
          );
        }
      }
      return res;
    });
  }

  /**
   * encodeUriComponent, but with !'()* included
   */
  private encodeURI(str: string) {
    return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
      return "%" + c.charCodeAt(0).toString(16);
    });
  }

  /**
   * Ensures that the directory exists.
   * If the directory structure does not exist, it is created.
   */
  async ensureDir(path: string) {
    try {
      await fs.access(path, constants.F_OK);
    } catch {
      await fs.mkdir(path);
    }
  }
}

export default Request;
