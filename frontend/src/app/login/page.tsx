import {
  LearningUnavailable,
  learningUnavailableMetadata,
} from "@/components/shared/learning-unavailable";

export async function generateMetadata() {
  return learningUnavailableMetadata();
}

export default function LoginPage() {
  return <LearningUnavailable />;
}
