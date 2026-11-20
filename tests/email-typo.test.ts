import { expect, it } from "vitest";
import { suggestEmail } from "@/lib/email-typo";

it("suggests the common domain for typical typos", () => {
  expect(suggestEmail("karim@gmial.com")).toBe("karim@gmail.com");
  expect(suggestEmail("karim@gmail.con")).toBe("karim@gmail.com");
  expect(suggestEmail("karim@gamil.com")).toBe("karim@gmail.com");
  expect(suggestEmail("karim@yaho.com")).toBe("karim@yahoo.com");
  expect(suggestEmail("karim@hotmial.com")).toBe("karim@hotmail.com");
});

it("leaves correct and unrelated domains alone", () => {
  expect(suggestEmail("karim@gmail.com")).toBeNull();
  expect(suggestEmail("karim@du.ac.bd")).toBeNull();
  expect(suggestEmail("karim@company.com.bd")).toBeNull();
  expect(suggestEmail("not-an-email")).toBeNull();
});
