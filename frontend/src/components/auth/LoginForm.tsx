import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

import { loginSchema, type LoginFormValues } from '@/lib/validations/login.schema'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { RoleBadge, detectRole } from './RoleBadge'

interface LoginFormProps {
  onSubmit: (values: LoginFormValues) => void
  isLoading: boolean
  error: string | null
  gagalLogin?: number
}

export function LoginForm({ onSubmit, isLoading, error: _error, gagalLogin }: LoginFormProps): JSX.Element {
  const [showPassword, setShowPassword] = useState(false)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: {
      identifier: '',
      password: '',
    },
  })

  const identifier = form.watch('identifier')
  const role = detectRole(identifier)
  const showKaderWarning = role === 'kader' && gagalLogin !== undefined && gagalLogin >= 7

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Field: Nomor Identitas */}
        <FormField
          control={form.control}
          name="identifier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nomor Identitas</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
                  placeholder="NIK, No HP, atau Email"
                  autoFocus
                  autoComplete="username"
                />
              </FormControl>
              <FormMessage />
              <RoleBadge identifier={identifier} />
            </FormItem>
          )}
        />

        {/* Field: Kata Sandi / PIN */}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kata Sandi / PIN</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    {...field}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••"
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    aria-pressed={showPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Kader PIN warning */}
        {showKaderWarning && (
          <p
            className={
              gagalLogin! >= 9
                ? 'text-xs font-semibold text-red-600'
                : 'text-xs text-amber-600'
            }
          >
            {gagalLogin! >= 9
              ? 'Peringatan: 1 percobaan tersisa!'
              : `Peringatan: ${10 - gagalLogin!} percobaan tersisa sebelum akun terkunci 30 menit.`}
          </p>
        )}

        {/* CTA */}
        <Button
          type="submit"
          className="w-full min-h-[44px] bg-[#008236] hover:bg-[#00a63e] text-white rounded-[14px]"
          disabled={isLoading}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin mr-2" size={18} />
              Masuk...
            </>
          ) : (
            'Masuk ke SISPOS'
          )}
        </Button>
      </form>
    </Form>
  )
}
