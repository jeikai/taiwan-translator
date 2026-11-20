import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Đăng nhập · Phiên dịch tiếng Đài" };

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
