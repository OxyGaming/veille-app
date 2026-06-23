import { describe, expect, it } from "vitest";
import {
  FALLBACK_BODY,
  FALLBACK_TARGET_URL,
  FALLBACK_TITLE,
  NOTIFICATION_BADGE,
  NOTIFICATION_ICON,
  buildNotificationOptions,
  normalizePushTargetUrl,
  parsePushPayload,
  readTargetUrlFromNotification,
} from "./sw-helpers";

const ORIGIN = "https://veille.example.com";

describe("parsePushPayload", () => {
  it("happy path — payload complet conservé", () => {
    const out = parsePushPayload({
      notificationId: "n1",
      title: "Titre",
      body: "Corps du message",
      targetUrl: "/agents/a1",
      tag: "ECHEANCE_CRITICAL:n1",
    });
    expect(out).toEqual({
      notificationId: "n1",
      title: "Titre",
      body: "Corps du message",
      targetUrl: "/agents/a1",
      tag: "ECHEANCE_CRITICAL:n1",
    });
  });

  it("payload null → fallback complet", () => {
    expect(parsePushPayload(null)).toEqual({
      notificationId: null,
      title: FALLBACK_TITLE,
      body: FALLBACK_BODY,
      targetUrl: null,
      tag: null,
    });
  });

  it("payload undefined → fallback complet", () => {
    expect(parsePushPayload(undefined)).toEqual({
      notificationId: null,
      title: FALLBACK_TITLE,
      body: FALLBACK_BODY,
      targetUrl: null,
      tag: null,
    });
  });

  it("payload array → fallback (objet attendu)", () => {
    expect(parsePushPayload([1, 2, 3])).toEqual({
      notificationId: null,
      title: FALLBACK_TITLE,
      body: FALLBACK_BODY,
      targetUrl: null,
      tag: null,
    });
  });

  it("title vide → fallback title", () => {
    const out = parsePushPayload({ title: "", body: "x" });
    expect(out.title).toBe(FALLBACK_TITLE);
    expect(out.body).toBe("x");
  });

  it("body vide → fallback body", () => {
    const out = parsePushPayload({ title: "X", body: "" });
    expect(out.body).toBe(FALLBACK_BODY);
  });

  it("types non-string → ignorés", () => {
    const out = parsePushPayload({
      notificationId: 42,
      title: { foo: "bar" },
      body: null,
      targetUrl: ["x"],
      tag: false,
    });
    expect(out).toEqual({
      notificationId: null,
      title: FALLBACK_TITLE,
      body: FALLBACK_BODY,
      targetUrl: null,
      tag: null,
    });
  });

  it("notificationId string vide → null", () => {
    expect(parsePushPayload({ notificationId: "" }).notificationId).toBeNull();
  });

  it("tag string vide → null", () => {
    expect(parsePushPayload({ tag: "" }).tag).toBeNull();
  });
});

describe("normalizePushTargetUrl", () => {
  it("null → fallback", () => {
    expect(normalizePushTargetUrl(null, ORIGIN)).toBe(FALLBACK_TARGET_URL);
  });

  it("undefined → fallback", () => {
    expect(normalizePushTargetUrl(undefined, ORIGIN)).toBe(FALLBACK_TARGET_URL);
  });

  it("string vide → fallback", () => {
    expect(normalizePushTargetUrl("", ORIGIN)).toBe(FALLBACK_TARGET_URL);
  });

  it("path relatif valide conservé", () => {
    expect(normalizePushTargetUrl("/agents/a1", ORIGIN)).toBe("/agents/a1");
  });

  it("path relatif avec query+hash conservé", () => {
    expect(
      normalizePushTargetUrl("/agents/a1?actionId=x#section", ORIGIN),
    ).toBe("/agents/a1?actionId=x#section");
  });

  it("URL protocole-relatif `//evil.com/x` → fallback (sécurité)", () => {
    expect(normalizePushTargetUrl("//evil.com/x", ORIGIN)).toBe(
      FALLBACK_TARGET_URL,
    );
  });

  it("URL absolue same-origin → garde path/query/hash uniquement", () => {
    expect(
      normalizePushTargetUrl(`${ORIGIN}/sites/s1?x=1#a`, ORIGIN),
    ).toBe("/sites/s1?x=1#a");
  });

  it("URL absolue cross-origin → fallback (sécurité)", () => {
    expect(
      normalizePushTargetUrl("https://evil.com/steal", ORIGIN),
    ).toBe(FALLBACK_TARGET_URL);
  });

  it("URL absolue http → vs https → fallback (origin diffère par scheme)", () => {
    expect(
      normalizePushTargetUrl("http://veille.example.com/x", ORIGIN),
    ).toBe(FALLBACK_TARGET_URL);
  });

  it("URL invalide non parsable → fallback", () => {
    expect(normalizePushTargetUrl("not a url", ORIGIN)).toBe(
      FALLBACK_TARGET_URL,
    );
  });

  it("javascript: URI → fallback", () => {
    expect(
      normalizePushTargetUrl("javascript:alert(1)", ORIGIN),
    ).toBe(FALLBACK_TARGET_URL);
  });

  it("data: URI → fallback", () => {
    expect(
      normalizePushTargetUrl("data:text/html,<script>x</script>", ORIGIN),
    ).toBe(FALLBACK_TARGET_URL);
  });
});

describe("buildNotificationOptions", () => {
  it("happy path — title+body+tag+data conformes", () => {
    const { title, options } = buildNotificationOptions(
      {
        notificationId: "n1",
        title: "Titre",
        body: "Corps",
        targetUrl: "/agents/a1",
        tag: "ACTION:n1",
      },
      ORIGIN,
    );
    expect(title).toBe("Titre");
    expect(options.body).toBe("Corps");
    expect(options.tag).toBe("ACTION:n1");
    expect(options.icon).toBe(NOTIFICATION_ICON);
    expect(options.badge).toBe(NOTIFICATION_BADGE);
    expect(options.data).toEqual({
      notificationId: "n1",
      targetUrl: "/agents/a1",
    });
  });

  it("renotify activé seulement si tag présent", () => {
    const a = buildNotificationOptions(
      {
        notificationId: null,
        title: "T",
        body: "B",
        targetUrl: null,
        tag: "ABC",
      },
      ORIGIN,
    );
    expect(
      (a.options as { renotify?: boolean }).renotify,
    ).toBe(true);

    const b = buildNotificationOptions(
      {
        notificationId: null,
        title: "T",
        body: "B",
        targetUrl: null,
        tag: null,
      },
      ORIGIN,
    );
    expect(b.options.tag).toBeUndefined();
    expect(
      (b.options as { renotify?: boolean }).renotify,
    ).toBeUndefined();
  });

  it("targetUrl cross-origin → forcé vers fallback dans data", () => {
    const { options } = buildNotificationOptions(
      {
        notificationId: "n1",
        title: "T",
        body: "B",
        targetUrl: "https://evil.com/leak",
        tag: null,
      },
      ORIGIN,
    );
    expect(
      (options.data as { targetUrl: string }).targetUrl,
    ).toBe(FALLBACK_TARGET_URL);
  });
});

describe("readTargetUrlFromNotification", () => {
  it("renvoie le targetUrl posé par buildNotificationOptions", () => {
    expect(
      readTargetUrlFromNotification(
        { notificationId: "n1", targetUrl: "/agents/a1" },
        ORIGIN,
      ),
    ).toBe("/agents/a1");
  });

  it("data null → fallback", () => {
    expect(readTargetUrlFromNotification(null, ORIGIN)).toBe(
      FALLBACK_TARGET_URL,
    );
  });

  it("data sans targetUrl → fallback", () => {
    expect(readTargetUrlFromNotification({ foo: "bar" }, ORIGIN)).toBe(
      FALLBACK_TARGET_URL,
    );
  });

  it("targetUrl cross-origin dans data → re-normalisé (défense en profondeur)", () => {
    expect(
      readTargetUrlFromNotification(
        { targetUrl: "https://evil.com/x" },
        ORIGIN,
      ),
    ).toBe(FALLBACK_TARGET_URL);
  });
});
