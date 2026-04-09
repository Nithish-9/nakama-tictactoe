FROM heroiclabs/nakama-pluginbuilder:latest AS builder

ENV GO111MODULE=on
ENV CGO_ENABLED=1

WORKDIR /backend

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build --trimpath --buildmode=plugin -o ./backend.so

FROM heroiclabs/nakama:3.26.0

COPY --from=builder /backend/backend.so /nakama/data/modules/
COPY ./local.yml /nakama/data/