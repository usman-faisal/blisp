import { useAuth, useSignUp } from '@clerk/expo'
import { type Href, Link, useRouter } from 'expo-router'
import React from 'react'
import { Pressable, TextInput, View, ActivityIndicator } from 'react-native'
import Text from '@/components/ui/Text'

export default function Page() {
  const { signUp, errors, fetchStatus } = useSignUp()
  const { isSignedIn } = useAuth()
  const router = useRouter()

  const [emailAddress, setEmailAddress] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [code, setCode] = React.useState('')

  const handleSubmit = async () => {
    const { error } = await signUp.password({ emailAddress, password })
    if (error) {
      console.error(JSON.stringify(error, null, 2))
      return
    }
    if (!error) await signUp.verifications.sendEmailCode()
  }

  const handleVerify = async () => {
    await signUp.verifications.verifyEmailCode({ code })
    if (signUp.status === 'complete') {
      await signUp.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) {
            console.log(session?.currentTask)
            return
          }
          const url = decorateUrl('/')
          if (url.startsWith('http')) {
            window.location.href = url
          } else {
            router.push(url as Href)
          }
        },
      })
    } else {
      console.error('Sign-up attempt not complete:', signUp)
    }
  }

  const isFetching = fetchStatus === 'fetching'

  if (signUp.status === 'complete' || isSignedIn) {
    return null
  }

  // — Verification screen —
  if (
    signUp.status === 'missing_requirements' &&
    signUp.unverifiedFields.includes('email_address') &&
    signUp.missingFields.length === 0
  ) {
    return (
      <View className="flex-1 bg-core-background px-6 pt-20">
        {/* Eyebrow */}
        <Text className="font-text text-xs font-semibold uppercase tracking-widest text-brand-ember mb-2">
          Almost there
        </Text>

        <Text className="font-heading text-4xl text-core-text-primary mb-2">
          Verify your email
        </Text>

        <Text className="font-text text-base text-core-text-secondary mb-10 leading-6">
          We sent a 6-digit code to{' '}
          <Text className="font-semibold text-core-text-primary">{emailAddress}</Text>.
        </Text>

        {/* Code input */}
        <Text className="font-text text-xs font-semibold uppercase tracking-widest text-core-text-secondary mb-2">
          Verification code
        </Text>
        <TextInput
          className="w-full bg-core-surface border border-semantic-border rounded-2xl px-4 py-4 font-text text-base text-core-text-primary mb-1"
          value={code}
          placeholder="000000"
          placeholderTextColor="#B0AAA3"
          onChangeText={setCode}
          keyboardType="numeric"
        />
        {errors.fields.code && (
          <Text className="font-text text-xs text-semantic-danger mt-1 mb-3">
            {errors.fields.code.message}
          </Text>
        )}

        {/* Verify button */}
        <Pressable
          className={`w-full rounded-2xl py-4 items-center mt-6 bg-brand-ember ${isFetching ? 'opacity-50' : 'opacity-100'}`}
          onPress={handleVerify}
          disabled={isFetching}
        >
          {isFetching
            ? <ActivityIndicator color="#F7F4EF" />
            : <Text className="font-text text-base font-semibold text-core-background">Verify email</Text>
          }
        </Pressable>

        {/* Resend */}
        <Pressable
          className="w-full rounded-2xl py-4 items-center mt-3 bg-core-surface"
          onPress={() => signUp.verifications.sendEmailCode()}
        >
          <Text className="font-text text-sm font-semibold text-brand-ember">
            Resend code
          </Text>
        </Pressable>
      </View>
    )
  }

  // — Main sign-up screen —
  return (
    <View className="flex-1 bg-core-background px-6 pt-20">
      {/* Eyebrow */}
      <Text className="font-text text-xs font-semibold uppercase tracking-widest text-brand-ember mb-2">
        Get started
      </Text>

      <Text className="font-heading text-4xl text-core-text-primary mb-2">
        Create account
      </Text>

      <Text className="font-text text-base text-core-text-secondary mb-10 leading-6">
        Turn your ideas into action, starting today.
      </Text>

      {/* Email */}
      <Text className="font-text text-xs font-semibold uppercase tracking-widest text-core-text-secondary mb-2">
        Email address
      </Text>
      <TextInput
        className="w-full bg-core-surface border border-semantic-border rounded-2xl px-4 py-4 font-text text-base text-core-text-primary mb-1"
        autoCapitalize="none"
        value={emailAddress}
        placeholder="you@example.com"
        placeholderTextColor="#B0AAA3"
        onChangeText={setEmailAddress}
        keyboardType="email-address"
      />
      {errors.fields.emailAddress && (
        <Text className="font-text text-xs text-semantic-danger mt-1 mb-2">
          {errors.fields.emailAddress.message}
        </Text>
      )}

      {/* Password */}
      <Text className="font-text text-xs font-semibold uppercase tracking-widest text-core-text-secondary mt-4 mb-2">
        Password
      </Text>
      <TextInput
        className="w-full bg-core-surface border border-semantic-border rounded-2xl px-4 py-4 font-text text-base text-core-text-primary mb-1"
        value={password}
        placeholder="Create a strong password"
        placeholderTextColor="#B0AAA3"
        secureTextEntry
        onChangeText={setPassword}
      />
      {errors.fields.password && (
        <Text className="font-text text-xs text-semantic-danger mt-1 mb-2">
          {errors.fields.password.message}
        </Text>
      )}

      {/* Submit */}
      <Pressable
        className={`w-full rounded-2xl py-4 items-center mt-8 bg-brand-ember ${(!emailAddress || !password || isFetching) ? 'opacity-50' : 'opacity-100'}`}
        onPress={handleSubmit}
        disabled={!emailAddress || !password || isFetching}
      >
        {isFetching
          ? <ActivityIndicator color="#F7F4EF" />
          : <Text className="font-text text-base font-semibold text-core-background">Create account</Text>
        }
      </Pressable>

      {/* Sign-in link */}
      <View className="flex-row items-center justify-center gap-x-1 mt-6">
        <Text className="font-text text-sm text-core-text-secondary">Already have an account?</Text>
        <Link href="./sign-in">
          <Text className="font-text text-sm font-semibold text-brand-flax">Sign in</Text>
        </Link>
      </View>

      {/* Required for Clerk bot protection */}
      <View nativeID="clerk-captcha" />
    </View>
  )
}