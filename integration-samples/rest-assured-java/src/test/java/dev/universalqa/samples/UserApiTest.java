package dev.universalqa.samples;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.fail;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import io.restassured.RestAssured;
import io.restassured.response.Response;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

/**
 * A deliberately small REST Assured project. It starts a local HTTP server, so
 * validation never depends on the network, and writes its own log/JSON
 * evidence for the JUnit attachment manifest.
 */
class UserApiTest {
  private static HttpServer server;
  private static Path evidenceDirectory;

  @BeforeAll
  static void startLocalServer() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/api/users/1", exchange -> respond(
        exchange,
        200,
        "{\"id\":1,\"name\":\"Ada Lovelace\",\"role\":\"engineer\"}"
    ));
    server.createContext("/api/users/404", exchange -> respond(
        exchange,
        404,
        "{\"error\":\"not found\"}"
    ));
    server.start();

    RestAssured.baseURI = "http://127.0.0.1";
    RestAssured.port = server.getAddress().getPort();

    evidenceDirectory = Path.of("target", "evidence");
    Files.createDirectories(evidenceDirectory);
  }

  @AfterAll
  static void stopLocalServer() {
    if (server != null) {
      server.stop(0);
    }
  }

  @Test
  void returnsUserById() throws IOException {
    Response response = given()
        .accept("application/json")
        .when()
        .get("/api/users/1")
        .then()
        .statusCode(200)
        .body("name", equalTo("Ada Lovelace"))
        .body("role", equalTo("engineer"))
        .extract()
        .response();

    writeEvidence("user-response.json", response.asPrettyString() + "\n");
    writeEvidence(
        "user-response.log",
        "GET /api/users/1 -> " + response.statusCode() + "\n"
            + response.asPrettyString() + "\n"
    );
    System.out.println("[external-sample] verified user payload: " + response.asString());
  }

  @Test
  void reportsMismatchedRole() throws IOException {
    Response response = given()
        .accept("application/json")
        .when()
        .get("/api/users/1")
        .then()
        .statusCode(200)
        .extract()
        .response();

    writeEvidence("failure-response.json", response.asPrettyString() + "\n");
    writeEvidence(
        "failure-response.log",
        "GET /api/users/1 -> " + response.statusCode()
            + " (intentional assertion mismatch follows)\n"
            + response.asPrettyString() + "\n"
    );
    System.out.println(
        "[external-sample] captured failure response, status=" + response.statusCode()
    );

    assertEquals(
        "manager",
        response.jsonPath().getString("role"),
        "Intentional mismatch: the sample asserts a role that the server does not return."
    );
  }

  @Test
  void reportsMissingUser() {
    given()
        .accept("application/json")
        .when()
        .get("/api/users/404")
        .then()
        .statusCode(404)
        .body("error", equalTo("not found"));
    System.out.println("[external-sample] verified missing-user response");
  }

  @Test
  @Disabled("Intentional skip used to validate JUnit skipped classification.")
  void skippedExample() {
    fail("This test must never run.");
  }

  private static void respond(HttpExchange exchange, int status, String body)
      throws IOException {
    byte[] payload = body.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
    exchange.sendResponseHeaders(status, payload.length);
    exchange.getResponseBody().write(payload);
    exchange.close();
  }

  private static void writeEvidence(String name, String content) throws IOException {
    Files.writeString(
        evidenceDirectory.resolve(name),
        content,
        StandardCharsets.UTF_8
    );
  }
}
