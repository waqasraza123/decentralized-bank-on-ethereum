import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, type MemoryRouterProps } from "react-router-dom";
import { routerFuture } from "@/lib/router-future";

type RenderWithRouterOptions = Omit<MemoryRouterProps, "children">;

export function renderWithRouter(
  element: ReactElement,
  options?: RenderWithRouterOptions,
) {
  return render(
    <MemoryRouter future={routerFuture} {...options}>
      {element}
    </MemoryRouter>,
  );
}
