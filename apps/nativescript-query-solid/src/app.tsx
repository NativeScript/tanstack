import { CollectionView } from "@nativescript-community/ui-collectionview";
import { ItemLoadingEventData } from "@nativescript-dom/core-types";
import { Route, StackRouter } from "./router";
import { Home } from "./routes/home";
import { makeListView, registerElement } from "dominative";
import { GalaxyButton } from "./routes/galaxy-button";
import { GrowingPlant } from "./routes/growing-plant";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";

registerElement(
  "collectionview",
  makeListView(CollectionView, { force: true })
);

declare global {
  interface HTMLCollectionViewElement extends HTMLListViewElement {}

  var HTMLCollectionViewElement: {
    prototype: HTMLCollectionViewElement;
    new (): HTMLCollectionViewElement;
  };

  interface HTMLCollectionViewElement extends HTMLListViewElement {}

  var HTMLCollectionViewElement: {
    prototype: HTMLCollectionViewElement;
    new (): HTMLCollectionViewElement;
  };
}

declare module "@nativescript-dom/solidjs-types/jsx-runtime" {
  export namespace JSX {
    interface IntrinsicElements {
      /**
       * Register custom library view
       */
      collectionview: Partial<
        HTMLListViewElementAttributes<HTMLCollectionViewElement>
      >;

      /**
       * Register dominative elements
       */
      itemtemplate: Partial<
        HTMLViewBaseElementAttributes & {
          "on:createView": (event: ItemLoadingEventData) => void;
          "on:itemLoading": (event: ItemLoadingEventData) => void;
          key: string;
        }
      >;
      arrayprop: Partial<
        HTMLViewBaseElementAttributes & {
          key: string;
        }
      >;
      keyprop: Partial<
        HTMLViewBaseElementAttributes & {
          key: string;
        }
      >;
    }
  }
}

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <StackRouter initialRouteName="Home">
        <Route name="Home" component={Home} />
        <Route name="GalaxyButton" component={GalaxyButton} />
        <Route name="GrowingPlant" component={GrowingPlant} />
      </StackRouter>
    </QueryClientProvider>
  );
};

export { App };
