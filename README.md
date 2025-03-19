# API Wrapper for n8n
## SETUP
.env file should be provided containing params URL (e.g. 'http://n8nserver.com:port') and API_KEY

## RUNNING
node --env-file=.env main.js;

Replace functions in main() to adjust output.

## INTENDED USAGE
'n8n.get.ENTITY' should allow us to retrieve details about an entitiy that we can then reload into n8n by 'n8n.post.ENTITY(INSTANCE, ENTITY)'
can be used as a base for backup of assets.
can be used to programatically enable and disable workflows with tags, etc.

## TODO:
- complete $http wrapper
- add all n8n endpoints
- figure out params and best way to present this in the API.
- handle pagination
