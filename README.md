## linkedin-video-scraper

### Installation
1. Run `npm install` to install Node.js packages.
2. Build by running `npm run build` command.

### Usage
You can build the code first, or by running `npm run start -- [... <args>]` command.

Basic usage :

```shell
node dist/cmd/scraper --username <LinkedIn username> --password <LinkedIn password>
```
Usage with keywords :
```shell
node dist/cmd/scraper --username <LinkedIn username> --password <LinkedIn password> --keywords "society"
```
### Arguments/options :
```shell
-k, --keywords [keywords]  Keywords to search (default: "#video")
-U, --username <username>  LinkedIn account username or email
-P, --password <password>  LinkedIn account password
--limit [number]           Public post search limit (default: 50)
--min [number]             Video minimum duration in seconds (default: 2)
--max [number]             Video maximum duration in seconds (default: 30)
--data-dir [path]          Data directory path (default: "./data")
-h, --help                 display help for command
```

## Knowledge
Thanks.
- https://github.com/tomquirk/linkedin-api
- https://github.com/everping/Linkedin-Authentication-Challenge
