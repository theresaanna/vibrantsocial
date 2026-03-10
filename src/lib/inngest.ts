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

export const inngest = new Inngest({
  id: "vibrantsocial",
  middleware: [sentryMiddleware],
});
