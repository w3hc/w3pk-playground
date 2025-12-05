'use client'

import { NumberInput as ChakraNumberInput } from '@chakra-ui/react'
import { forwardRef } from 'react'

export const NumberInput = {
  Root: ChakraNumberInput.Root,
  Label: ChakraNumberInput.Label,
  Field: ChakraNumberInput.Input,
  Control: ChakraNumberInput.Control,
  IncrementTrigger: ChakraNumberInput.IncrementTrigger,
  DecrementTrigger: ChakraNumberInput.DecrementTrigger,
  Scrubber: ChakraNumberInput.Scrubber,
  ValueText: ChakraNumberInput.ValueText,
}
