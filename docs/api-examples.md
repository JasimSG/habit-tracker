# API examples

## Health

GET `/api/health`

## Dashboard

GET `/api/dashboard?userId=1`

## Create habit

POST `/api/habits`

```json
{"userId":1,"name":"Read 20 minutes","target":1}
```

## Log habit

POST `/api/logs`

```json
{"userId":1,"habitId":1,"value":"done"}
```
