'use server';

import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from '@/node_modules/next/cache';
import { redirect } from '@/node_modules/next/navigation';

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer',
  }),
  amount: z.coerce.number().gt(0, {
    message: 'Please enter an amount greater than $0.',
  }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status',
  }),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

const UpdateInvoice = FormSchema.omit({
  id: true,
  date: true,
});

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  messages?: string | null;
};

export async function createInvoice(prevState:State,formData: FormData) {
  // validate form using Zod
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  // if form validation fails, return errors early.Otherwise, continue
  if (!validatedFields.success){
    // https://zod.dev/ERROR_HANDLING?id=flattening-errors
    // console.log(validatedFields.error.flatten())
    return {
      errors:validatedFields.error.flatten().fieldErrors,
      message:'Missing fields.Failed to create invoice. '
    }
  }

  // Prepare data for insertion into the database
  const {customerId,amount,status} = validatedFields.data
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  // Insert data into the database
  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
      `;
  } catch (error) {
    // If a database error occurs, return a more specific error
    return {
      message: 'Failed to create an invoice.',
    };
  }

  // Revalidate the cache for the invoices page and redirect the user
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function updateInvoice(prevState:State,id: string, formData: FormData) {
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      errors:validatedFields.error.flatten().fieldErrors,
      message:"Failed to update the invoice"
    }
  }
  const {customerId,amount,status} = validatedFields.data
  const amountInCents = amount * 100;

  try {
    await sql`
    UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id}`;
  } catch (error) {
    console.log(error);
  }

  revalidatePath('/dashvboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {

  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
  } catch (error) {
    return {
      message: 'Database Error: Failed to delete the invoice',
    };
  }
  revalidatePath('/dashboard/invoices');
}
