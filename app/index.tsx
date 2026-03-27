import { Redirect } from 'expo-router';

export default function Index() {
  // Redirect to login page by default
  return <Redirect href="/login" />;
}
