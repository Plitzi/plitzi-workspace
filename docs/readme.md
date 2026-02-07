# plitzi-workspace

for deployments you will need to run:

- `yarn changeset` and select the packages that will go into the release
- `yarn changeset version` to bump the version of the packages
- make a release in github

# Note:

to work in this project you will have to update your hosts file with the next changes

```
127.0.0.1       plitzi.local
::1             plitzi.local
127.0.0.1       server.plitzi.local
::1             server.plitzi.local
127.0.0.1       ssr.plitzi.local
::1             ssr.plitzi.local
127.0.0.1       api.plitzi.local
::1             api.plitzi.local
127.0.0.1       app.plitzi.local
::1             app.plitzi.local
```

and you will need to enable https in your local environment to support `crypto` and hostnames
