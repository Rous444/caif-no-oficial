# Phase 6: Testing

**Goal**: Write comprehensive tests for the application.

**Estimated time**: 2-3 hours

**Depends on**: [Phase 1](./01-infrastructure-cicd.md), [Phase 3](./03-server-functions.md)

## Tasks

### 6.1 Unit Tests

Create `src/test/utils.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";
import { hashPassword, verifyPassword, validatePasswordStrength } from "@/lib/password";

describe("cn utility", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
  });

  it("deduplicates tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});

describe("password utilities", () => {
  it("hashes password", async () => {
    const hash = await hashPassword("test123");
    expect(hash).toBeDefined();
    expect(hash).not.toBe("test123");
  });

  it("verifies correct password", async () => {
    const hash = await hashPassword("test123");
    const valid = await verifyPassword("test123", hash);
    expect(valid).toBe(true);
  });

  it("rejects incorrect password", async () => {
    const hash = await hashPassword("test123");
    const valid = await verifyPassword("wrong", hash);
    expect(valid).toBe(false);
  });

  it("validates password strength - too short", () => {
    const result = validatePasswordStrength("abc");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("8 caracteres");
  });

  it("validates password strength - no uppercase", () => {
    const result = validatePasswordStrength("lowercase123");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("mayúscula");
  });

  it("validates password strength - no lowercase", () => {
    const result = validatePasswordStrength("UPPERCASE123");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("minúscula");
  });

  it("validates password strength - no number", () => {
    const result = validatePasswordStrength("NoNumbersHere");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("número");
  });

  it("validates strong password", () => {
    const result = validatePasswordStrength("StrongPass123");
    expect(result.valid).toBe(true);
  });
});
```

Create `src/test/schemas.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { z } from "zod";

// Import your Zod schemas here
// Example:
// import { createDoctorSchema } from "@/lib/api/admin-users.functions";

describe("validation schemas", () => {
  describe("createDoctorSchema", () => {
    // Add tests for doctor creation validation
    it("requires firstName", () => {
      // Test that firstName is required
    });

    it("requires valid email", () => {
      // Test email validation
    });

    it("requires specialtyId", () => {
      // Test specialty validation
    });
  });

  describe("registerSchema", () => {
    // Add tests for patient registration validation
    it("requires all fields", () => {
      // Test required fields
    });

    it("validates DNI format", () => {
      // Test DNI is numeric and correct length
    });

    it("validates email format", () => {
      // Test email format
    });
  });
});
```

### 6.2 Component Tests

Create `src/test/components/dashboard-layout.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

// Mock the useAuth hook
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { email: "test@example.com", role: "paciente" },
    signOut: vi.fn(),
  }),
}));

// Mock the router
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

describe("DashboardLayout", () => {
  it("renders title and description", () => {
    render(
      <DashboardLayout title="Test Title" description="Test Description">
        <div>Child content</div>
      </DashboardLayout>
    );

    expect(screen.getByText("Test Title")).toBeDefined();
    expect(screen.getByText("Test Description")).toBeDefined();
    expect(screen.getByText("Child content")).toBeDefined();
  });

  it("renders user email", () => {
    render(
      <DashboardLayout title="Test">
        <div>Content</div>
      </DashboardLayout>
    );

    expect(screen.getByText("test@example.com")).toBeDefined();
  });

  it("renders sign out button", () => {
    render(
      <DashboardLayout title="Test">
        <div>Content</div>
      </DashboardLayout>
    );

    expect(screen.getByText("Salir")).toBeDefined();
  });
});
```

Create `src/test/components/password-change.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChangePasswordPage } from "@/routes/change-password";

// Mock the auth hook
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: "123", mustChangePassword: true },
    refreshUser: vi.fn(),
  }),
}));

// Mock the server function
vi.mock("@/lib/api/auth.functions", () => ({
  changePassword: vi.fn(),
}));

describe("ChangePasswordPage", () => {
  it("renders password change form", () => {
    render(<ChangePasswordPage />);

    expect(screen.getByText("Cambiar contraseña")).toBeDefined();
    expect(screen.getByLabelText("Contraseña actual")).toBeDefined();
    expect(screen.getByLabelText("Nueva contraseña")).toBeDefined();
    expect(screen.getByLabelText("Confirmar contraseña")).toBeDefined();
  });

  it("shows validation errors for empty fields", async () => {
    render(<ChangePasswordPage />);

    const submitButton = screen.getByRole("button", { name: "Cambiar contraseña" });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Contraseña actual requerida")).toBeDefined();
    });
  });

  it("shows error when passwords don't match", async () => {
    render(<ChangePasswordPage />);

    fireEvent.change(screen.getByLabelText("Contraseña actual"), {
      target: { value: "current123" },
    });
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
      target: { value: "NewPass123" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
      target: { value: "DifferentPass123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    await waitFor(() => {
      expect(screen.getByText("Las contraseñas no coinciden")).toBeDefined();
    });
  });
});
```

### 6.3 Integration Tests

Create `src/test/integration/auth.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { eq } from "drizzle-orm";

describe("Auth Integration", () => {
  const testEmail = `test-${Date.now()}@example.com`;

  afterAll(async () => {
    // Clean up test user
    await db.delete(users).where(eq(users.email, testEmail));
  });

  it("creates user with hashed password", async () => {
    const password = "TestPass123";
    const passwordHash = await hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({
        email: testEmail,
        passwordHash,
        firstName: "Test",
        lastName: "User",
        phone: "1234567890",
        role: "paciente",
      })
      .returning();

    expect(newUser).toBeDefined();
    expect(newUser.email).toBe(testEmail);
    expect(newUser.passwordHash).not.toBe(password);
    expect(newUser.role).toBe("paciente");
  });

  it("prevents duplicate email", async () => {
    const passwordHash = await hashPassword("TestPass123");

    await expect(
      db.insert(users).values({
        email: testEmail,
        passwordHash,
        firstName: "Test",
        lastName: "User",
        phone: "1234567890",
        role: "paciente",
      }),
    ).rejects.toThrow();
  });
});
```

### 6.4 API Tests

Create `src/test/api/admin-users.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDoctorAccount } from "@/lib/api/admin-users.functions";

// Mock the database
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(),
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}));

// Mock email service
vi.mock("@/lib/email", () => ({
  sendWelcomeEmail: vi.fn(),
}));

describe("createDoctorAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates doctor account with correct data", async () => {
    // Mock that email doesn't exist
    const mockDb = await import("@/db");
    vi.mocked(mockDb.db.query.users.findFirst).mockResolvedValue(null);
    vi.mocked(mockDb.db.insert).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "123", email: "doctor@test.com" }]),
      }),
    } as any);

    const result = await createDoctorAccount({
      data: {
        firstName: "Juan",
        lastName: "Perez",
        email: "doctor@test.com",
        phone: "1234567890",
        specialtyId: "uuid-here",
      },
    });

    expect(result.user.email).toBe("doctor@test.com");
    expect(result.temporaryPassword).toBeDefined();
  });

  it("throws error if email already exists", async () => {
    const mockDb = await import("@/db");
    vi.mocked(mockDb.db.query.users.findFirst).mockResolvedValue({
      id: "existing",
      email: "doctor@test.com",
    } as any);

    await expect(
      createDoctorAccount({
        data: {
          firstName: "Juan",
          lastName: "Perez",
          email: "doctor@test.com",
          phone: "1234567890",
          specialtyId: "uuid-here",
        },
      }),
    ).rejects.toThrow("Ya existe un usuario con este email");
  });
});
```

### 6.5 Update package.json

Add test script:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### 6.6 Update CI/CD Workflow

Update `.github/workflows/ci.yml` to run tests:

```yaml
- name: Unit Tests
  run: bun run test
  env:
    DATABASE_URL: postgresql://medicare:test_password@localhost:5432/medicare_test
    BETTER_AUTH_SECRET: test-secret-key-for-ci-only-32-chars!!
    BETTER_AUTH_URL: http://localhost:3000
```

## Test Coverage Goals

| Area               | Target Coverage |
| ------------------ | --------------- |
| Password utilities | 100%            |
| Validation schemas | 100%            |
| Auth functions     | 90%             |
| Admin functions    | 85%             |
| Components         | 80%             |
| Integration        | 70%             |

## Verification Checklist

- [ ] All unit tests pass
- [ ] All component tests pass
- [ ] Integration tests pass with test database
- [ ] API tests pass with mocked database
- [ ] Test coverage meets targets
- [ ] `bun run test:watch` works for development
- [ ] CI/CD runs tests on every push
- [ ] Test results saved to `test/` directory
