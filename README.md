# Configuration

Requires node: v18.18.0 if running on node
Go to: https://discord.com/developers/applications
create a new application and name whaever you want
go to bots -> and create a new bot if it's not there, otherwise reset the token and copy the token
go to Oauth -> in scopes ->select the bot options -> select the permissions-> generate url and copy -> opent url in new tab and authorize the server where you wanna add the bot

# Docker Compose Configuration

Build:

```
docker build --no-cache -t eu_fetcher .
```

Run:

```
docker compose up -d
```

To check logs:

```
docker logs --tail 10 -f eu_fetcher
```
