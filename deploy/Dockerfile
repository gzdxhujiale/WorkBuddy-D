# Build Stage
FROM golang:1.24-alpine AS builder

WORKDIR /src

# Cache dependencies
COPY server/go.mod server/go.sum ./
RUN go mod download

# Copy source and build minimal static binary
COPY server/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /bin/workbuddy-server ./cmd/server

# Production Runtime Stage
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app
COPY --from=builder /bin/workbuddy-server /app/workbuddy-server

EXPOSE 8080

ENV GIN_MODE=release \
    PORT=8080

ENTRYPOINT ["/app/workbuddy-server"]
