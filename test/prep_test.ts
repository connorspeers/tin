// Copyright 2022 Connor Speers. All rights reserved. MIT License.

import { prepTest, prepWatchTest } from "./_prep.ts";

Deno.test("prep", prepTest);
Deno.test("prep + watch", prepWatchTest);

// TODO: Custom logging functions
// TODO: Rebundle when a non-prepped dependency is updated
// TODO: Rebundle properly when a filename is changed
// TODO: Removes bundles for deleted/moved sources
// TODO: Watching the same directory more than once only creates one prep loop
