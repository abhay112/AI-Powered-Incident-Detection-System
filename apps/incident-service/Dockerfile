FROM node:20-alpine

# Install git for commit diff functionality
RUN apk add --no-cache git

WORKDIR /app

# Initialize a git repo for commit diff simulation
RUN git init && \
    git config user.email "sre@example.com" && \
    git config user.name "SRE Bot" && \
    echo "# AI Incident System" > README.md && \
    git add . && \
    git commit -m "feat: initial setup of incident detection system" && \
    echo "console.log('service initialized');" > init.js && \
    git add . && \
    git commit -m "fix: resolve null pointer exception in user service\n\nPreviously userService.processUser() would throw when user.profile was\nundefined. Added optional chaining and null guards throughout the module." && \
    touch api-changes.js && \
    echo "// API handler updated" > api-changes.js && \
    git add . && \
    git commit -m "refactor: update API error handling in process route\n\nChanged error propagation to use async/await pattern instead of\ncallback-based approach. This may have introduced a regression in\nerror boundary handling."

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

EXPOSE 4000

CMD ["node", "dist/index.js"]
