import { CollectionView } from "@nativescript-community/ui-collectionview";
import { ItemLoadingEventData } from "@nativescript-dom/core-types";
import { makeListView, registerElement } from "dominative";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { Route, StackRouter } from "./router";
import { Posts } from "./routes/posts";
import { Post } from "./routes/post";

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
      <StackRouter initialRouteName="Posts">
        <Route name="Posts" component={Posts} />
        <Route name="Post" component={Post} />
      </StackRouter>
    </QueryClientProvider>
  );
};

export { App };
