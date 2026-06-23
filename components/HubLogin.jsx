import LoginForm from '@/components/LoginForm';

export default function HubLogin() {
  return (
    <LoginForm
      titleKey="login.title"
      loginEndpoint="/api/auth/login"
      defaultRedirect="/"
      nameId="hub-display-name"
    />
  );
}
