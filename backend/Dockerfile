# IPO Manager backend — multi-stage build.
# Stage 1 compiles the jar; stage 2 runs it. No local Maven/Java needed.

FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /src
COPY pom.xml .
COPY src ./src
RUN mvn -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /src/target/*.jar app.jar

EXPOSE 8080

# Persist the H2 file database across container restarts/updates.
VOLUME ["/app/data"]

# REQUIRED at run time: KYC_ENCRYPTION_KEY (base64 of 32 random bytes).
# Generate with: openssl rand -base64 32
# Example:
#   docker build -t ipo-manager-backend ./backend
#   docker run -d -p 8080:8080 -v ipo-data:/app/data \
#     -e KYC_ENCRYPTION_KEY='<your-key>' ipo-manager-backend
ENTRYPOINT ["java", "-jar", "app.jar"]
