import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";
import setCookie, { CookieMap } from "set-cookie-parser";
import cookie from "cookie";
import fs from "fs/promises";
import { constants, createWriteStream, unlinkSync, ReadStream } from "fs";
import { v4 } from "uuid";
import { PostEntity } from "../types/post-entity";
import { PostUpdatesV2MediaEntity } from "../types/post-updatesv2-entity";
import * as cheerio from "cheerio";
import { CookieJar } from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";

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
  duration: {
    min: number;
    max: number;
  };
}

interface CookieValue {
  username: string;
  cookies: string;
  csrfToken: string;
}

class LinkedIn {
  user!: { username: string; password: string };
  request!: AxiosInstance;
  LINKEDIN_BASE_URL = "https://www.linkedin.com";
  LINKEDIN_API_BASE_URL = `${this.LINKEDIN_BASE_URL}/voyager/api`;
  CSRF_TOKEN?: string;
  COOKIES?: string;
  MAX_SEARCH_COUNT = 49;
  DATA_DIR!: string;
  COOKIE_FILE_PATH!: string;
  DOWNLOADS_DIR!: string;

  constructor(username: string, password: string, dataDir = "./data") {
    this.DATA_DIR = dataDir;
    this.COOKIE_FILE_PATH = `${this.DATA_DIR}/cookie.json`;
    this.DOWNLOADS_DIR = `${this.DATA_DIR}/downloads`;

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
    keywords,
    limit = -1,
    offset = 0,
    duration,
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
          posts.map((ent) => ent.targetUnion.updateV2Urn),
          duration.min,
          duration.max
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
  private async downloadVideoIfExist(urn: string[], min: number, max: number) {
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

            if (durationInSec < min || durationInSec > max) {
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
    } catch (e) {
      if (e instanceof AxiosError) {
        switch (e.response?.data.login_result) {
          case "CHALLENGE":
            throw new LinkedInChallengeError("linkedin challenge error");
          case "BAD_PASSWORD":
          case "BAD_EMAIL":
            throw new InvalidCredentialsError("invalid credentials");
        }
      } else if (e instanceof Error) {
        e.message = `an error occurred while authenticating: ${e.message}`;
        throw e;
      }
    }
  }

  async doAuthChallenge(onPin: () => Promise<string>) {
    const SEED_URL = "https://www.linkedin.com/uas/login";
    const LOGIN_URL = "https://www.linkedin.com/checkpoint/lg/login-submit";
    const VERIFY_URL = "https://www.linkedin.com/checkpoint/challenge/verify";

    let $: cheerio.CheerioAPI;
    const jar = new CookieJar();
    const http = wrapper(
      axios.create({
        responseType: "text",
        headers: {
          "User-Agent": "LinkedIn/8.8.1 CFNetwork/711.3.18 Darwin/14.0.0",
        },
        jar,
      })
    );

    const seedRes = await http.get(SEED_URL);
    $ = cheerio.load(seedRes.data);
    const loginCsrfParam = $(`input[name="loginCsrfParam"]`).val() as string;

    const loginRes = await http.post(
      LOGIN_URL,
      new URLSearchParams({
        session_key: "kvsouw@gmail.com",
        loginCsrfParam,
        session_password: "Misbahul123@",
      })
    );
    $ = cheerio.load(loginRes.data);

    const url = new URL(loginRes.request.res.responseUrl);
    if (!/^\/checkpoint\/challenge\/[a-zA-Z0-9_\-]+/.test(url.pathname)) {
      throw new Error("login failed");
    }

    const inputs = $("form#email-pin-challenge input").toArray();
    const payload = new URLSearchParams();

    inputs.forEach((el) => {
      payload.set(el.attribs["name"], el.attribs["value"]);
    });

    const pin = await onPin();
    payload.set("pin", pin);

    const verifyRes = await http.post(VERIFY_URL, payload);
    $ = cheerio.load(verifyRes.data);
  }

  async ensureDataDir() {
    await this.ensureDir(this.DATA_DIR);
    await this.ensureDir(this.DOWNLOADS_DIR);
  }

  async getSessionCookies() {
    const res = await this.request.get("uas/authenticate");
    const cookies = setCookie(res.headers["set-cookie"]!, { map: true });
    this.setCookies(cookies);
    // strip double quotes
    this.CSRF_TOKEN = cookies.JSESSIONID.value.replace(/\"/g, "");
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

  /**
   * Load cookie from saved cookie file
   */
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
        if (cookies.JSESSIONID && cookies.li_at) {
          this.setCookies(cookies);
          // strip double quotes
          this.CSRF_TOKEN = cookies.JSESSIONID.value.replace(/\"/g, "");

          let cookieValues: CookieValue[] = [];
          const currentCookie = {
            username: this.user.username,
            cookies: this.COOKIES!,
            csrfToken: this.CSRF_TOKEN!,
          };

          try {
            // load and parse from file
            cookieValues = JSON.parse(
              await fs.readFile(this.COOKIE_FILE_PATH, { encoding: "utf-8" })
            );
            const cookieIdx = cookieValues.findIndex(
              (c) => c.username === this.user.username
            );
            // add if doesn't exist, see the catch block
            if (cookieIdx === -1) throw void 0;

            cookieValues[cookieIdx] = currentCookie;
          } catch {
            cookieValues.push(currentCookie);
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

export class InvalidCredentialsError extends Error {}

export class LinkedInChallengeError extends Error {}

export default LinkedIn;
