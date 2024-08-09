import { createStackRouter, RouteDefinition } from "solid-navigation";
import { Post } from "@org/state";

declare module "solid-navigation" {
  export interface Routers {
    Default: {
      Posts: RouteDefinition;
      Post: RouteDefinition<Post>;
    };
  }
}

export const { Route, StackRouter, useParams, useRouter } =
  createStackRouter<"Default">();
