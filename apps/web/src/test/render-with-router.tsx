import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, type MemoryRouterProps } from "react-router-dom";
import { WebI18nProvider } from "@/i18n/provider";
import { routerFuture } from "@/lib/router-future";

type RenderWithRouterOptions = Omit<MemoryRouterProps, "children">;

export function renderWithRouter(
  element: ReactElement,
  options?: RenderWithRouterOptions,
) {
  return render(
    <WebI18nProvider>
      <MemoryRouter future={routerFuture} {...options}>
        {element}
      </MemoryRouter>
    </WebI18nProvider>,
  );
}
