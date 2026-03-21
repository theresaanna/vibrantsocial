import { Inngest, InngestMiddleware } from "inngest";
import * as Sentry from "@sentry/nextjs";

const sentryMiddleware = new InngestMiddleware({
  name: "Sentry Middleware",
  init() {
    return {
      onFunctionRun({ fn }) {
        return {
          transformOutput({ result }) {
            if (result.error) {
              Sentry.captureException(result.error, {
                extra: { inngestFunctionId: fn.id },
              });
            }
          },
        };
      },
    };
  },
});

const _inngest = new Inngest({
  id: "vibrantsocial",
  middleware: [sentryMiddleware],
});

// In local dev without INNGEST_EVENT_KEY, send() throws 401.
// Wrap with a proxy that silently drops events when unconfigured.
export const inngest = new Proxy(_inngest, {
  get(target, prop, receiver) {
    if (prop === "send" && !process.env.INNGEST_EVENT_KEY) {
      return async () => {};
    }
    return Reflect.get(target, prop, receiver);
  },
});
