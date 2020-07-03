
#For this challenge, you are given a range and you need to find how many prime numbers lying between the given range. 

#Input Format
#For this challenge, you need to take two integers on separate lines. These numbers defines the range. 

#Constraints
#1 < = ( a , b ) < = 100000

#Output Format
#output will be the single number which tells how many prime numbers are there between given range. 

import math
def main():

 in1 = int(input())
 in2 = int(input())
 r  = range(in1, in2+1)
 num = []
 for i in r:
     count = 0
     for j in range(1, i+1):
         if math.modf(i/j)[0] == 0:
             count = count + 1
     if count < 3:
         num.append(i)
 print(len(num[1:len(num)]), end = "")
     


main()
