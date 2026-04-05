import { useSignIn } from '@clerk/expo'
import { type Href, Link, useRouter } from 'expo-router'
import React from 'react'
import { Pressable, TextInput, View, ActivityIndicator } from 'react-native'
import Text from '@/components/ui/Text'

export default function Page() {
  const { signIn, errors, fetchStatus } = useSignIn()
  const router = useRouter()

  const [emailAddress, setEmailAddress] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [code, setCode] = React.useState('')

  const handleSubmit = async () => {
    const { error } = await signIn.password({ emailAddress, password })
    if (error) {
      console.error(JSON.stringify(error, null, 2))
      return
    }

    if (signIn.status === 'complete') {
      await signIn.finalize({
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
    } else if (signIn.status === 'needs_second_factor' || signIn.status === 'needs_client_trust') {
      const emailCodeFactor = signIn.supportedSecondFactors.find(
        (factor) => factor.strategy === 'email_code',
      )
      if (emailCodeFactor) {
        await signIn.mfa.sendEmailCode()
      }
    } else {
      console.error('Sign-in attempt not complete:', signIn)
    }
  }

  const handleVerify = async () => {
    await signIn.mfa.verifyEmailCode({ code })

    if (signIn.status === 'complete') {
      await signIn.finalize({
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
      console.error('Sign-in attempt not complete:', signIn)
    }
  }

  const isFetching = fetchStatus === 'fetching'

  // — MFA / verification screen —
  if (signIn.status === 'needs_second_factor' || signIn.status === 'needs_client_trust') {
    return (
      <View className="flex-1 bg-core-background px-6 pt-20">
        {/* Eyebrow */}
        <Text className="font-text text-xs font-semibold uppercase tracking-widest text-brand-ember mb-2">
          Two-step verification
        </Text>

        <Text className="font-heading text-4xl text-core-text-primary mb-2">
          Check your inbox
        </Text>

        <Text className="font-text text-base text-core-text-secondary mb-10 leading-6">
          We sent a verification code to your email address.
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
          className={`w-full rounded-2xl py-4 items-center mt-6 ${isFetching ? 'bg-brand-ember opacity-50' : 'bg-brand-ember'}`}
          onPress={handleVerify}
          disabled={isFetching}
        >
          {isFetching
            ? <ActivityIndicator color="#F7F4EF" />
            : <Text className="font-text text-base font-semibold text-core-background">Verify</Text>
          }
        </Pressable>

        {/* Resend */}
        <Pressable
          className="w-full rounded-2xl py-4 items-center mt-3 bg-core-surface"
          onPress={() => signIn.mfa.sendEmailCode()}
        >
          <Text className="font-text text-sm font-semibold text-brand-ember">
            Resend code
          </Text>
        </Pressable>
      </View>
    )
  }

  // — Main sign-in screen —
  return (
    <View className="flex-1 bg-core-background px-6 pt-20">
      {/* Eyebrow */}
      <Text className="font-text text-xs font-semibold uppercase tracking-widest text-brand-ember mb-2">
        Welcome back
      </Text>

      <Text className="font-heading text-4xl text-core-text-primary mb-2">
        Sign in
      </Text>

      <Text className="font-text text-base text-core-text-secondary mb-10 leading-6">
        Pick up right where you left off.
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
      {errors.fields.identifier && (
        <Text className="font-text text-xs text-semantic-danger mt-1 mb-2">
          {errors.fields.identifier.message}
        </Text>
      )}

      {/* Password */}
      <Text className="font-text text-xs font-semibold uppercase tracking-widest text-core-text-secondary mt-4 mb-2">
        Password
      </Text>
      <TextInput
        className="w-full bg-core-surface border border-semantic-border rounded-2xl px-4 py-4 font-text text-base text-core-text-primary mb-1"
        value={password}
        placeholder="••••••••"
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
          : <Text className="font-text text-base font-semibold text-core-background">Continue</Text>
        }
      </Pressable>

      {/* Sign-up link */}
      <View className="flex-row items-center justify-center gap-x-1 mt-6">
        <Text className="font-text text-sm text-core-text-secondary">Don't have an account?</Text>
        <Link href="./sign-up">
          <Text className="font-text text-sm font-semibold text-brand-flax">Sign up</Text>
        </Link>
      </View>
    </View>
  )
}