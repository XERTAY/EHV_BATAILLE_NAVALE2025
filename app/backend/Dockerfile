FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /workspace

# Build backend module using the root Maven parent.
COPY pom.xml ./pom.xml
COPY app/backend/pom.xml ./app/backend/pom.xml
COPY app/backend/src ./app/backend/src
RUN mvn -pl app/backend -am clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

COPY --from=build /workspace/app/backend/target/*.jar /app/app.jar

EXPOSE 4784
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
