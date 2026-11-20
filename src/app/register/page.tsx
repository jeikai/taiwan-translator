import { AuthForm } from "@/components/AuthForm";

export const metadata = { title: "Đăng ký · Phiên dịch tiếng Đài" };

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
